namespace SchoolAdmission.Api.Data;

public class SchoolClass
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public string Name { get; set; } = string.Empty;

    public int TotalSeats { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public class Hold
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid ClassId { get; set; }

    public string StudentId { get; set; } = string.Empty;

    public string Status { get; set; } = "HELD";

    public DateTimeOffset ExpiresAt { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
