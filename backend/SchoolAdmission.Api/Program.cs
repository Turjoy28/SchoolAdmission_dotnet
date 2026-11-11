using Microsoft.EntityFrameworkCore;
using SchoolAdmission.Api.Data;
using SchoolAdmission.Api.Endpoints;
using SchoolAdmission.Api.Errors;
using SchoolAdmission.Api.Services;

var builder = WebApplication.CreateBuilder(args);

// Database connection
var connectionString =
    builder.Configuration.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException(
        "Database connection string is missing."
    );

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(connectionString)
);

// Business services
builder.Services.AddScoped<SeatService>();

// CORS configuration
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy
            .AllowAnyOrigin()
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

// Centralized Exception Handling & Problem Details
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<ApiExceptionHandler>();

// OpenAPI
builder.Services.AddOpenApi();

var app = builder.Build();

// Centralized error handling middleware
app.UseExceptionHandler();

// CORS
app.UseCors();

// Automatic database migrations
if (app.Configuration.GetValue("RUN_MIGRATIONS", true))
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.Migrate();
}

// API documentation
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

// Register API endpoints
app.MapClassEndpoints();
app.MapHoldEndpoints();
app.MapAdminEndpoints();

app.Run();

// Required for integration testing with WebApplicationFactory<Program>
public partial class Program { }
