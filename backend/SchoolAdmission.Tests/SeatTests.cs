using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace SchoolAdmission.Tests;

public class SeatTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;
    private readonly WebApplicationFactory<Program> _factory;

    public SeatTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    private async Task<string> CreateClassAsync(int seats, string name = "Test Class")
    {
        var res = await _client.PostAsJsonAsync("/classes", new { name, totalSeats = seats });
        res.EnsureSuccessStatusCode();
        var body = await res.Content.ReadFromJsonAsync<JsonElement>();
        return body.GetProperty("id").GetString()!;
    }

    [Fact]
    public async Task Parallel_applications_never_exceed_total_seats()
    {
        var classId = await CreateClassAsync(5, "Concurrency Class");

        var calls = Enumerable.Range(0, 50).Select(i =>
        {
            var req = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classId}/holds");
            req.Headers.Add("X-Student-Id", (10000000000000000L + i).ToString()); // 17 digits
            return _client.SendAsync(req);
        });

        var responses = await Task.WhenAll(calls);

        Assert.Equal(5, responses.Count(r => r.StatusCode == HttpStatusCode.Created));
        Assert.Equal(45, responses.Count(r => r.StatusCode == HttpStatusCode.Conflict));

        var cls = await _client.GetFromJsonAsync<JsonElement>($"/classes/{classId}");
        Assert.Equal(5, cls.GetProperty("heldSeats").GetInt32());
        Assert.Equal(0, cls.GetProperty("availableSeats").GetInt32());
    }

    [Fact]
    public async Task Duplicate_application_to_same_class_fails()
    {
        var classId = await CreateClassAsync(5, "Duplicate Check Class");
        const string studentId = "12345678901234567";

        var req1 = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classId}/holds");
        req1.Headers.Add("X-Student-Id", studentId);
        var res1 = await _client.SendAsync(req1);
        Assert.Equal(HttpStatusCode.Created, res1.StatusCode);

        var req2 = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classId}/holds");
        req2.Headers.Add("X-Student-Id", studentId);
        var res2 = await _client.SendAsync(req2);
        Assert.Equal(HttpStatusCode.Conflict, res2.StatusCode);
    }

    [Fact]
    public async Task Idempotent_confirm_maintains_exact_seat_count()
    {
        var classId = await CreateClassAsync(5, "Idempotent Confirm Class");
        const string studentId = "22345678901234567";

        var req = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classId}/holds");
        req.Headers.Add("X-Student-Id", studentId);
        var res = await _client.SendAsync(req);
        Assert.Equal(HttpStatusCode.Created, res.StatusCode);

        var holdData = await res.Content.ReadFromJsonAsync<JsonElement>();
        var holdId = holdData.GetProperty("holdId").GetString()!;

        // Confirm 1
        var confirmReq1 = new HttpRequestMessage(HttpMethod.Post, $"/holds/{holdId}/confirm");
        confirmReq1.Headers.Add("X-Student-Id", studentId);
        var confirmRes1 = await _client.SendAsync(confirmReq1);
        Assert.Equal(HttpStatusCode.OK, confirmRes1.StatusCode);

        // Confirm 2 (duplicate)
        var confirmReq2 = new HttpRequestMessage(HttpMethod.Post, $"/holds/{holdId}/confirm");
        confirmReq2.Headers.Add("X-Student-Id", studentId);
        var confirmRes2 = await _client.SendAsync(confirmReq2);
        Assert.Equal(HttpStatusCode.OK, confirmRes2.StatusCode);

        // Verify counts
        var cls = await _client.GetFromJsonAsync<JsonElement>($"/classes/{classId}");
        Assert.Equal(1, cls.GetProperty("confirmedSeats").GetInt32());
        Assert.Equal(0, cls.GetProperty("heldSeats").GetInt32());
        Assert.Equal(4, cls.GetProperty("availableSeats").GetInt32());
    }

    [Fact]
    public async Task Expired_hold_frees_seat_and_rejects_confirm()
    {
        var shortExpiryClient = _factory.WithWebHostBuilder(b =>
        {
            b.UseSetting("HOLD_DURATION_SECONDS", "1");
        }).CreateClient();

        // Create class
        var resCls = await shortExpiryClient.PostAsJsonAsync("/classes", new { name = "Expiry Class", totalSeats = 1 });
        var clsBody = await resCls.Content.ReadFromJsonAsync<JsonElement>();
        var classId = clsBody.GetProperty("id").GetString()!;

        const string studentId = "32345678901234567";

        // Apply
        var applyReq = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classId}/holds");
        applyReq.Headers.Add("X-Student-Id", studentId);
        var applyRes = await shortExpiryClient.SendAsync(applyReq);
        Assert.Equal(HttpStatusCode.Created, applyRes.StatusCode);

        var holdData = await applyRes.Content.ReadFromJsonAsync<JsonElement>();
        var holdId = holdData.GetProperty("holdId").GetString()!;

        // Wait 1.5 seconds for expiry
        await Task.Delay(1500);

        // Check hold status -> EXPIRED
        var holdRes = await shortExpiryClient.GetFromJsonAsync<JsonElement>($"/holds/{holdId}");
        Assert.Equal("EXPIRED", holdRes.GetProperty("status").GetString());

        // Check seat is available again
        var cls = await shortExpiryClient.GetFromJsonAsync<JsonElement>($"/classes/{classId}");
        Assert.Equal(0, cls.GetProperty("heldSeats").GetInt32());
        Assert.Equal(1, cls.GetProperty("availableSeats").GetInt32());

        // Confirming expired hold must fail with 409
        var confirmReq = new HttpRequestMessage(HttpMethod.Post, $"/holds/{holdId}/confirm");
        confirmReq.Headers.Add("X-Student-Id", studentId);
        var confirmRes = await shortExpiryClient.SendAsync(confirmReq);
        Assert.Equal(HttpStatusCode.Conflict, confirmRes.StatusCode);
    }
}
