export class NotificationError {
  constructor(
    public readonly message: string,
    public readonly field?: string,
  ) {}
}

export class Notification<T = void> {
  private readonly errors: NotificationError[] = [];
  private resultValue?: T;

  private constructor() {}

  // Создает успешный ответ
  static ok<T>(value?: T): Notification<T> {
    const notification = new Notification<T>();
    notification.resultValue = value;
    return notification;
  }

  // Удобный метод для быстрого создания ошибки с одним сообщением
  static fail<T>(message: string, field?: string): Notification<T> {
    const notification = new Notification<T>();
    notification.addError(message, field);
    return notification;
  }

  // Создает пустой объект для начала валидации
  static create<T>(): Notification<T> {
    return new Notification<T>();
  }

  // Добавляет ошибку в список
  addError(message: string, field?: string): void {
    this.errors.push(new NotificationError(message, field));
  }

  hasErrors(): boolean {
    return this.errors.length > 0;
  }

  get isSuccess(): boolean {
    return !this.hasErrors();
  }

  get getErrors(): NotificationError[] {
    return [...this.errors];
  }

  get value(): T {
    if (this.hasErrors()) {
      throw new Error('Cannot get value from a notification with errors');
    }
    return this.resultValue as T;
  }
}
