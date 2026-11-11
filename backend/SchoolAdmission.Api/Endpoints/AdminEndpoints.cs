using SchoolAdmission.Api.Models;
using SchoolAdmission.Api.Services;

namespace SchoolAdmission.Api.Endpoints;

public static class AdminEndpoints
{
    public static IEndpointRouteBuilder MapAdminEndpoints(
        this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/admin/holds", GetAdminHoldsAsync);
        endpoints.MapPost("/admin/holds/{holdId:guid}/transfer", TransferHoldAsync);
        endpoints.MapDelete("/admin/holds/{holdId:guid}", CancelAdminHoldAsync);

        return endpoints;
    }

    // GET /admin/holds
    private static async Task<IResult> GetAdminHoldsAsync(
        SeatService seatService,
        CancellationToken cancellationToken)
    {
        var response = await seatService.GetAdminHoldsAsync(cancellationToken);
        return Results.Ok(response);
    }

    // POST /admin/holds/{holdId}/transfer
    private static async Task<IResult> TransferHoldAsync(
        Guid holdId,
        TransferHoldRequest request,
        SeatService seatService,
        CancellationToken cancellationToken)
    {
        var response = await seatService.TransferHoldAsync(holdId, request, cancellationToken);
        return Results.Ok(response);
    }

    // DELETE /admin/holds/{holdId}
    private static async Task<IResult> CancelAdminHoldAsync(
        Guid holdId,
        SeatService seatService,
        CancellationToken cancellationToken)
    {
        await seatService.AdminCancelHoldAsync(holdId, cancellationToken);
        return Results.NoContent();
    }
}
