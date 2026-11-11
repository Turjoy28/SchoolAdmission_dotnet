using Microsoft.EntityFrameworkCore;

namespace SchoolAdmission.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(
        DbContextOptions<AppDbContext> options
    ) : base(options)
    {
    }

    public DbSet<SchoolClass> Classes => Set<SchoolClass>();

    public DbSet<Hold> Holds => Set<Hold>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // School Classes table
        modelBuilder.Entity<SchoolClass>(entity =>
        {
            entity.ToTable("classes");

            entity.HasKey(c => c.Id);

            entity.Property(c => c.Id)
                .HasColumnName("id");

            entity.Property(c => c.Name)
                .HasColumnName("name")
                .HasMaxLength(100)
                .IsRequired();

            entity.Property(c => c.TotalSeats)
                .HasColumnName("total_seats")
                .IsRequired();

            entity.Property(c => c.CreatedAt)
                .HasColumnName("created_at")
                .HasColumnType("timestamp with time zone");
        });

        // Admission Holds table
        modelBuilder.Entity<Hold>(entity =>
        {
            entity.ToTable("holds");

            entity.HasKey(h => h.Id);

            entity.Property(h => h.Id)
                .HasColumnName("id");

            entity.Property(h => h.ClassId)
                .HasColumnName("class_id");

            entity.Property(h => h.StudentId)
                .HasColumnName("student_id")
                .HasMaxLength(17)
                .IsRequired();

            entity.Property(h => h.Status)
                .HasColumnName("status")
                .HasMaxLength(20)
                .IsRequired();

            entity.Property(h => h.ExpiresAt)
                .HasColumnName("expires_at")
                .HasColumnType("timestamp with time zone");

            entity.Property(h => h.CreatedAt)
                .HasColumnName("created_at")
                .HasColumnType("timestamp with time zone");

            // One class can have many holds
            entity.HasOne<SchoolClass>()
                .WithMany()
                .HasForeignKey(h => h.ClassId)
                .OnDelete(DeleteBehavior.Restrict);

            // Indexes for efficient seat counting and student lookup
            entity.HasIndex(h => new
            {
                h.ClassId,
                h.Status,
                h.ExpiresAt
            });

            entity.HasIndex(h => h.StudentId);
        });
    }
}