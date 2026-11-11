namespace SchoolAdmission.Api.Models;

// Data received when creating a class
public sealed record CreateClassRequest(
    string? Name,
    int TotalSeats
);

// Response after creating a class
public sealed record CreateClassResponse(
    Guid Id,
    string Name,
    int TotalSeats
);

// Response when retrieving class information
public sealed record ClassResponse(
    Guid Id,
    string Name,
    int TotalSeats,
    int HeldSeats,
    int ConfirmedSeats,
    int AvailableSeats
);

// Standard API error response
public sealed record ApiError(
    int Status,
    string Message
);

// Response when a student successfully applies
public sealed record HoldCreatedResponse(
    Guid HoldId,
    Guid ClassId,
    string StudentId,
    string Status,
    DateTimeOffset ExpiresAt,
    string ClassName,
    DateTimeOffset ServerTime
);

// Response when retrieving a hold
public sealed record HoldDetailsResponse(
    Guid HoldId,
    Guid ClassId,
    string Status,
    DateTimeOffset ExpiresAt,
    string ClassName,
    DateTimeOffset ServerTime
);

// Response when confirming a hold
public sealed record ConfirmHoldResponse(
    Guid HoldId,
    string Status
);

// Response when listing a student's holds
public sealed record MyHoldResponse(
    Guid HoldId,
    Guid ClassId,
    string ClassName,
    string Status,
    DateTimeOffset ExpiresAt
);

// Response when admin views all student application holds
public sealed record AdminHoldItemResponse(
    Guid HoldId,
    Guid ClassId,
    string ClassName,
    string StudentId,
    string Status,
    DateTimeOffset ExpiresAt,
    DateTimeOffset CreatedAt
);

// Request for admin transferring a student hold to a new class
public sealed record TransferHoldRequest(
    Guid TargetClassId
);
