const { Op } = require('sequelize');
const { ActivityLog, User, AdminAccount } = require('../models');
const { success } = require('../utils/response');
const { parsePagination } = require('../utils/pagination');

// GET /api/activity-logs?action=&user_id=&admin_account_id=&start=&end=&page=&limit=
const getAll = async (req, res) => {
  const { action, user_id, admin_account_id, start, end } = req.query;
  const { page, limit, offset } = parsePagination(req.query, { defaultLimit: 50 });
  const where = {};
  if (action) where.action = action;
  if (user_id) where.user_id = user_id;
  if (admin_account_id) where.admin_id = admin_account_id;
  if (start && end) where.created_at = { [Op.between]: [new Date(start), new Date(end)] };

  const { rows, count } = await ActivityLog.findAndCountAll({
    where,
    include: [
      { model: User, as: 'user', attributes: ['nip', 'name'] },
      { model: AdminAccount, as: 'admin', attributes: ['username', 'name', 'role'] },
    ],
    order: [['created_at', 'DESC']],
    limit,
    offset,
  });

  return success(res, {
    data: rows,
    meta: { total: count, page, limit },
  });
};

module.exports = { getAll };
