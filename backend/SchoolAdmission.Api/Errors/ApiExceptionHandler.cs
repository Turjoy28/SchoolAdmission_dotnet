using Microsoft.AspNetCore.Diagnostics;
using SchoolAdmission.Api.Models;

namespace SchoolAdmission.Api.Errors;

public class ApiExceptionHandler : IExceptionHandler
{
    private readonly ILogger<ApiExceptionHandler> _logger;

    public ApiExceptionHandler(ILogger<ApiExceptionHandler> logger)
    {
        _logger = logger;
    }

    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        if (exception is ApiException apiException)
        {
            httpContext.Response.StatusCode = apiException.StatusCode;
            await httpContext.Response.WriteAsJsonAsync(
                new ApiError(apiException.StatusCode, apiException.Message),
                cancellationToken
            );
            return true;
        }

        _logger.LogError(exception, "An unhandled exception occurred: {Message}", exception.Message);

        httpContext.Response.StatusCode = StatusCodes.Status500InternalServerError;
        await httpContext.Response.WriteAsJsonAsync(
            new ApiError(StatusCodes.Status500InternalServerError, "An unexpected error occurred."),
            cancellationToken
        );

        return true;
    }
}
