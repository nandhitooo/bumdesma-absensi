enum NotificationType { piket, izinCuti }

class AppNotification {
  final String id;
  final NotificationType type;
  final String title;
  final String description;
  final DateTime createdAt;
  final bool read;

  const AppNotification({
    required this.id,
    required this.type,
    required this.title,
    required this.description,
    required this.createdAt,
    this.read = false,
  });

  AppNotification copyWith({bool? read}) {
    return AppNotification(
      id: id,
      type: type,
      title: title,
      description: description,
      createdAt: createdAt,
      read: read ?? this.read,
    );
  }
}
