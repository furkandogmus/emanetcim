/// A generic class that represents a result of an operation.
/// It can be either a [Success] or a [Failure].
///
/// This pattern is common in Clean Architecture to handle errors without
/// throwing exceptions that might be caught in the wrong layer.
abstract class Result<T> {
  const Result();

  bool get isSuccess => this is Success<T>;
  bool get isFailure => this is Failure<T>;

  T? get data => (this is Success<T>) ? (this as Success<T>).value : null;
  String? get error =>
      (this is Failure<T>) ? (this as Failure<T>).message : null;

  void when({
    required void Function(T data) onSuccess,
    required void Function(String message) onFailure,
  }) {
    if (this is Success<T>) {
      onSuccess((this as Success<T>).value);
    } else {
      onFailure((this as Failure<T>).message);
    }
  }

  R fold<R>(
    R Function(T data) onSuccess,
    R Function(String message) onFailure,
  ) {
    if (this is Success<T>) {
      return onSuccess((this as Success<T>).value);
    } else {
      return onFailure((this as Failure<T>).message);
    }
  }
}

class Success<T> extends Result<T> {
  final T value;
  const Success(this.value);
}

class Failure<T> extends Result<T> {
  final String message;
  final dynamic exception;

  const Failure(this.message, [this.exception]);
}
