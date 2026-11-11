using SchoolAdmission.Api.Models;
using SchoolAdmission.Api.Services;

namespace SchoolAdmission.Api.Endpoints;

public static class ClassEndpoints
{
    public static IEndpointRouteBuilder MapClassEndpoints(
        this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapPost("/classes", CreateClassAsync);
        endpoints.MapGet("/classes", GetClassesAsync);
        endpoints.MapGet(
            "/classes/{classId:guid}",
            GetClassByIdAsync
        );

        return endpoints;
    }

    // POST /classes
    private static async Task<IResult> CreateClassAsync(
        CreateClassRequest request,
        SeatService seatService,
        CancellationToken cancellationToken)
    {
        var response = await seatService.CreateClassAsync(request, cancellationToken);

        return Results.Created(
            $"/classes/{response.Id}",
            response
        );
    }

    // GET /classes
    private static async Task<IResult> GetClassesAsync(
        SeatService seatService,
        CancellationToken cancellationToken)
    {
        var response = await seatService.GetClassesAsync(cancellationToken);
        return Results.Ok(response);
    }

    // GET /classes/{classId}
    private static async Task<IResult> GetClassByIdAsync(
        Guid classId,
        SeatService seatService,
        CancellationToken cancellationToken)
    {
        var response = await seatService.GetClassAsync(classId, cancellationToken);
        return Results.Ok(response);
    }
}
