using Microsoft.AspNetCore.Mvc;
using SchoolAdmission.Api.Services;

namespace SchoolAdmission.Api.Endpoints;

public static class HoldEndpoints
{
    public static IEndpointRouteBuilder MapHoldEndpoints(
        this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapPost(
            "/classes/{classId:guid}/holds",
            ApplyAsync
        );

        endpoints.MapGet(
            "/holds/{holdId:guid}",
            GetHoldAsync
        );

        endpoints.MapPost(
            "/holds/{holdId:guid}/confirm",
            ConfirmAsync
        );

        endpoints.MapDelete(
            "/holds/{holdId:guid}",
            CancelAsync
        );

        endpoints.MapGet(
            "/me/holds",
            GetMyHoldsAsync
        );

        return endpoints;
    }

    // POST /classes/{classId}/holds
    private static async Task<IResult> ApplyAsync(
        Guid classId,
        [FromHeader(Name = "X-Student-Id")] string? studentId,
        SeatService seatService,
        CancellationToken cancellationToken)
    {
        var hold = await seatService.ApplyAsync(
            classId,
            studentId,
            cancellationToken
        );

        return Results.Created(
            $"/holds/{hold.HoldId}",
            hold
        );
    }

    // GET /holds/{holdId}
    private static async Task<IResult> GetHoldAsync(
        Guid holdId,
        SeatService seatService,
        CancellationToken cancellationToken)
    {
        var hold = await seatService.GetHoldAsync(
            holdId,
            cancellationToken
        );

        return Results.Ok(hold);
    }

    // POST /holds/{holdId}/confirm
    private static async Task<IResult> ConfirmAsync(
        Guid holdId,
        [FromHeader(Name = "X-Student-Id")] string? studentId,
        SeatService seatService,
        CancellationToken cancellationToken)
    {
        var result = await seatService.ConfirmAsync(
            holdId,
            studentId,
            cancellationToken
        );

        return Results.Ok(result);
    }

    // DELETE /holds/{holdId}
    private static async Task<IResult> CancelAsync(
        Guid holdId,
        [FromHeader(Name = "X-Student-Id")] string? studentId,
        SeatService seatService,
        CancellationToken cancellationToken)
    {
        await seatService.CancelAsync(
            holdId,
            studentId,
            cancellationToken
        );

        return Results.NoContent();
    }

    // GET /me/holds
    private static async Task<IResult> GetMyHoldsAsync(
        [FromHeader(Name = "X-Student-Id")] string? studentId,
        SeatService seatService,
        CancellationToken cancellationToken)
    {
        var holds = await seatService.GetMyHoldsAsync(
            studentId,
            cancellationToken
        );

        return Results.Ok(holds);
    }
}
