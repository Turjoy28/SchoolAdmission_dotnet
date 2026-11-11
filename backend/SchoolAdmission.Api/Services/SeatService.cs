using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using SchoolAdmission.Api.Data;
using SchoolAdmission.Api.Errors;
using SchoolAdmission.Api.Models;

namespace SchoolAdmission.Api.Services;

public class SeatService
{
    private readonly AppDbContext _db;
    private readonly int _holdDurationSeconds;

    public SeatService(
        AppDbContext db,
        IConfiguration configuration)
    {
        _db = db;

        _holdDurationSeconds =
            configuration.GetValue<int?>("HOLD_DURATION_SECONDS") ?? 600;

        if (_holdDurationSeconds <= 0)
        {
            throw new InvalidOperationException(
                "HOLD_DURATION_SECONDS must be a positive integer."
            );
        }
    }

    // =====================================================
    // CLASS OPERATIONS
    // =====================================================

    public async Task<CreateClassResponse> CreateClassAsync(
        CreateClassRequest request,
        CancellationToken cancellationToken = default)
    {
        var name = request.Name?.Trim();

        if (string.IsNullOrWhiteSpace(name) || name.Length > 100)
        {
            throw new ApiException(
                400,
                "Class name must be between 1 and 100 characters."
            );
        }

        if (request.TotalSeats < 1 || request.TotalSeats > 100000)
        {
            throw new ApiException(
                400,
                "Total seats must be between 1 and 100000."
            );
        }

        var schoolClass = new SchoolClass
        {
            Name = name,
            TotalSeats = request.TotalSeats
        };

        _db.Classes.Add(schoolClass);

        await _db.SaveChangesAsync(cancellationToken);

        return new CreateClassResponse(
            schoolClass.Id,
            schoolClass.Name,
            schoolClass.TotalSeats
        );
    }

    public async Task<List<ClassResponse>> GetClassesAsync(
        CancellationToken cancellationToken = default)
    {
        var now = DateTimeOffset.UtcNow;

        var classes = await _db.Classes
            .AsNoTracking()
            .OrderBy(c => c.CreatedAt)
            .Select(c => new
            {
                c.Id,
                c.Name,
                c.TotalSeats,

                HeldSeats = _db.Holds.Count(h =>
                    h.ClassId == c.Id &&
                    h.Status == "HELD" &&
                    h.ExpiresAt > now
                ),

                ConfirmedSeats = _db.Holds.Count(h =>
                    h.ClassId == c.Id &&
                    h.Status == "CONFIRMED"
                )
            })
            .ToListAsync(cancellationToken);

        return classes.Select(c =>
            new ClassResponse(
                c.Id,
                c.Name,
                c.TotalSeats,
                c.HeldSeats,
                c.ConfirmedSeats,
                c.TotalSeats - c.HeldSeats - c.ConfirmedSeats
            )
        ).ToList();
    }

    public async Task<ClassResponse> GetClassAsync(
        Guid classId,
        CancellationToken cancellationToken = default)
    {
        var now = DateTimeOffset.UtcNow;

        var schoolClass = await _db.Classes
            .AsNoTracking()
            .Where(c => c.Id == classId)
            .Select(c => new
            {
                c.Id,
                c.Name,
                c.TotalSeats,

                HeldSeats = _db.Holds.Count(h =>
                    h.ClassId == c.Id &&
                    h.Status == "HELD" &&
                    h.ExpiresAt > now
                ),

                ConfirmedSeats = _db.Holds.Count(h =>
                    h.ClassId == c.Id &&
                    h.Status == "CONFIRMED"
                )
            })
            .SingleOrDefaultAsync(cancellationToken);

        if (schoolClass is null)
        {
            throw new ApiException(404, "Class not found.");
        }

        return new ClassResponse(
            schoolClass.Id,
            schoolClass.Name,
            schoolClass.TotalSeats,
            schoolClass.HeldSeats,
            schoolClass.ConfirmedSeats,
            schoolClass.TotalSeats -
                schoolClass.HeldSeats -
                schoolClass.ConfirmedSeats
        );
    }

    public async Task DeleteClassAsync(
        Guid classId,
        CancellationToken cancellationToken = default)
    {
        var schoolClass = await _db.Classes
            .SingleOrDefaultAsync(c => c.Id == classId, cancellationToken);

        if (schoolClass is null)
        {
            throw new ApiException(404, "Class not found.");
        }

        // Remove associated holds to satisfy foreign key constraints
        var holds = await _db.Holds
            .Where(h => h.ClassId == classId)
            .ToListAsync(cancellationToken);

        if (holds.Count > 0)
        {
            _db.Holds.RemoveRange(holds);
        }

        _db.Classes.Remove(schoolClass);
        await _db.SaveChangesAsync(cancellationToken);
    }

    // =====================================================
    // SHARED VALIDATION
    // =====================================================

    private static string RequireStudentId(string? studentId)
    {
        if (studentId is null ||
            studentId.Length != 17 ||
            studentId.Any(c => c < '0' || c > '9'))
        {
            throw new ApiException(
                400,
                "Student ID must be exactly 17 digits."
            );
        }

        return studentId;
    }

    private static string EffectiveStatus(
        string status,
        DateTimeOffset expiresAt,
        DateTimeOffset now)
    {
        if (status == "HELD" && expiresAt <= now)
        {
            return "EXPIRED";
        }

        return status;
    }

    // =====================================================
    // 1. APPLY FOR ADMISSION
    // POST /classes/{classId}/holds
    // =====================================================

    public async Task<HoldCreatedResponse> ApplyAsync(
        Guid classId,
        string? studentIdHeader,
        CancellationToken cancellationToken = default)
    {
        var studentId = RequireStudentId(studentIdHeader);

        await using var transaction =
            await _db.Database.BeginTransactionAsync(cancellationToken);

        // Lock the class row before checking seats.
        var classExists = await LockClassRowAsync(
            classId,
            cancellationToken
        );

        if (!classExists)
        {
            throw new ApiException(404, "Class not found.");
        }

        // Read the class after acquiring the lock.
        var schoolClass = await _db.Classes
            .AsNoTracking()
            .SingleAsync(c => c.Id == classId, cancellationToken);

        // Read the clock AFTER acquiring the lock.
        var now = DateTimeOffset.UtcNow;

        var alreadyApplied = await _db.Holds.AnyAsync(
            h => h.ClassId == classId &&
                 h.StudentId == studentId &&
                 (
                     h.Status == "CONFIRMED" ||
                     (h.Status == "HELD" && h.ExpiresAt > now)
                 ),
            cancellationToken
        );

        if (alreadyApplied)
        {
            throw new ApiException(
                409,
                "You already have an application for this class."
            );
        }

        // Count all occupied seats.
        var usedSeats = await _db.Holds.CountAsync(
            h => h.ClassId == classId &&
                 (
                     h.Status == "CONFIRMED" ||
                     (h.Status == "HELD" && h.ExpiresAt > now)
                 ),
            cancellationToken
        );

        if (usedSeats >= schoolClass.TotalSeats)
        {
            throw new ApiException(
                409,
                "Sorry, no seats are left in this class."
            );
        }

        var hold = new Hold
        {
            ClassId = classId,
            StudentId = studentId,
            Status = "HELD",
            CreatedAt = now,
            ExpiresAt = now.AddSeconds(_holdDurationSeconds)
        };

        _db.Holds.Add(hold);

        await _db.SaveChangesAsync(cancellationToken);

        await transaction.CommitAsync(cancellationToken);

        return new HoldCreatedResponse(
            hold.Id,
            classId,
            studentId,
            hold.Status,
            hold.ExpiresAt,
            schoolClass.Name,
            now
        );
    }

    // =====================================================
    // 2. GET HOLD
    // GET /holds/{holdId}
    // =====================================================

    public async Task<HoldDetailsResponse> GetHoldAsync(
        Guid holdId,
        CancellationToken cancellationToken = default)
    {
        var hold = await (
            from h in _db.Holds.AsNoTracking()
            join c in _db.Classes.AsNoTracking()
                on h.ClassId equals c.Id
            where h.Id == holdId
            select new
            {
                h.Id,
                h.ClassId,
                h.Status,
                h.ExpiresAt,
                ClassName = c.Name
            }
        ).SingleOrDefaultAsync(cancellationToken);

        if (hold is null)
        {
            throw new ApiException(404, "Application not found.");
        }

        var now = DateTimeOffset.UtcNow;

        var effectiveStatus = EffectiveStatus(
            hold.Status,
            hold.ExpiresAt,
            now
        );

        return new HoldDetailsResponse(
            hold.Id,
            hold.ClassId,
            effectiveStatus,
            hold.ExpiresAt,
            hold.ClassName,
            now
        );
    }

    // =====================================================
    // 3. CONFIRM ADMISSION
    // POST /holds/{holdId}/confirm
    // =====================================================

    public async Task<ConfirmHoldResponse> ConfirmAsync(
        Guid holdId,
        string? studentIdHeader,
        CancellationToken cancellationToken = default)
    {
        var studentId = RequireStudentId(studentIdHeader);

        // Find the class associated with this hold.
        var classId = await _db.Holds
            .AsNoTracking()
            .Where(h => h.Id == holdId)
            .Select(h => (Guid?)h.ClassId)
            .SingleOrDefaultAsync(cancellationToken);

        if (classId is null)
        {
            throw new ApiException(404, "Application not found.");
        }

        await using var transaction =
            await _db.Database.BeginTransactionAsync(cancellationToken);

        // Use the same class lock as ApplyAsync.
        var classExists = await LockClassRowAsync(
            classId.Value,
            cancellationToken
        );

        if (!classExists)
        {
            throw new ApiException(404, "Class not found.");
        }

        // Read the hold AFTER obtaining the lock.
        var hold = await _db.Holds.SingleOrDefaultAsync(
            h => h.Id == holdId,
            cancellationToken
        );

        if (hold is null)
        {
            throw new ApiException(404, "Application not found.");
        }

        if (hold.StudentId != studentId)
        {
            throw new ApiException(
                403,
                "This application belongs to another student."
            );
        }

        // Confirming twice must not change the seat count.
        if (hold.Status == "CONFIRMED")
        {
            await transaction.CommitAsync(cancellationToken);

            return new ConfirmHoldResponse(
                hold.Id,
                hold.Status
            );
        }

        // Read time after acquiring the class lock.
        var now = DateTimeOffset.UtcNow;

        if (hold.Status != "HELD" || hold.ExpiresAt <= now)
        {
            throw new ApiException(
                409,
                "This application has expired or been cancelled."
            );
        }

        hold.Status = "CONFIRMED";

        await _db.SaveChangesAsync(cancellationToken);

        await transaction.CommitAsync(cancellationToken);

        return new ConfirmHoldResponse(
            hold.Id,
            hold.Status
        );
    }

    // =====================================================
    // 4. CANCEL APPLICATION
    // DELETE /holds/{holdId}
    // =====================================================

    public async Task CancelAsync(
        Guid holdId,
        string? studentIdHeader,
        CancellationToken cancellationToken = default)
    {
        var studentId = RequireStudentId(studentIdHeader);

        var classId = await _db.Holds
            .AsNoTracking()
            .Where(h => h.Id == holdId)
            .Select(h => (Guid?)h.ClassId)
            .SingleOrDefaultAsync(cancellationToken);

        if (classId is null)
        {
            throw new ApiException(404, "Application not found.");
        }

        await using var transaction =
            await _db.Database.BeginTransactionAsync(cancellationToken);

        // Serialize cancellation against apply and confirm.
        var classExists = await LockClassRowAsync(
            classId.Value,
            cancellationToken
        );

        if (!classExists)
        {
            throw new ApiException(404, "Class not found.");
        }

        var hold = await _db.Holds.SingleOrDefaultAsync(
            h => h.Id == holdId,
            cancellationToken
        );

        if (hold is null)
        {
            throw new ApiException(404, "Application not found.");
        }

        if (hold.StudentId != studentId)
        {
            throw new ApiException(
                403,
                "This application belongs to another student."
            );
        }

        // Repeated cancellation is idempotent.
        if (hold.Status == "CANCELLED")
        {
            await transaction.CommitAsync(cancellationToken);
            return;
        }

        var now = DateTimeOffset.UtcNow;

        if (hold.Status != "HELD" || hold.ExpiresAt <= now)
        {
            throw new ApiException(
                409,
                "This application is already confirmed or expired."
            );
        }

        hold.Status = "CANCELLED";

        await _db.SaveChangesAsync(cancellationToken);

        await transaction.CommitAsync(cancellationToken);
    }

    // =====================================================
    // 5. LIST STUDENT APPLICATIONS
    // GET /me/holds
    // =====================================================

    public async Task<List<MyHoldResponse>> GetMyHoldsAsync(
        string? studentIdHeader,
        CancellationToken cancellationToken = default)
    {
        var studentId = RequireStudentId(studentIdHeader);

        var now = DateTimeOffset.UtcNow;

        var holds = await (
            from h in _db.Holds.AsNoTracking()
            join c in _db.Classes.AsNoTracking()
                on h.ClassId equals c.Id
            where h.StudentId == studentId
            orderby h.CreatedAt descending
            select new MyHoldResponse(
                h.Id,
                h.ClassId,
                c.Name,
                h.Status == "HELD" && h.ExpiresAt <= now
                    ? "EXPIRED"
                    : h.Status,
                h.ExpiresAt
            )
        ).ToListAsync(cancellationToken);

        return holds;
    }

    // =====================================================
    // POSTGRESQL ROW LOCKING
    // =====================================================

    private async Task<bool> LockClassRowAsync(
        Guid classId,
        CancellationToken cancellationToken)
    {
        var connection = _db.Database.GetDbConnection();

        await using var command = connection.CreateCommand();

        command.Transaction =
            _db.Database.CurrentTransaction!.GetDbTransaction();

        // Lowercase identifiers match AppDbContext OnModelCreating mappings.
        command.CommandText =
            "SELECT id FROM classes WHERE id = @classId FOR UPDATE";

        var parameter = command.CreateParameter();

        parameter.ParameterName = "classId";
        parameter.Value = classId;

        command.Parameters.Add(parameter);

        var result = await command.ExecuteScalarAsync(
            cancellationToken
        );

        return result is not null && result is not DBNull;
    }
}
