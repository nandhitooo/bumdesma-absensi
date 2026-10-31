import { useAuth } from "../context/AuthContext";

export default function Topbar({ title }) {
  const { user } = useAuth();

  return (
    <div className="flex items-center justify-between px-6 py-4 bg-gray-100 border-b border-gray-200">
      <h1 className="text-2xl font-extrabold text-green-700">{title}</h1>
      <div className="flex items-center gap-2 font-bold text-gray-700">
        <div className="text-right">
          <div>{user?.name}</div>
          <div className="text-xs font-semibold text-gray-400 capitalize">{user?.role}</div>
        </div>
        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-700 border border-gray-200">
          <i className="fa-solid fa-user"></i>
        </div>
      </div>
    </div>
  );
}
