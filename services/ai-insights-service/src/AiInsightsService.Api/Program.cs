using Microsoft.EntityFrameworkCore;
using University360.BuildingBlocks;
var builder = WebApplication.CreateBuilder(args);
builder.AddPlatformDefaults<InsightsDbContext>();
var app = builder.Build();
app.UsePlatformDefaults();
await app.EnsureDatabaseReadyAsync<InsightsDbContext>();
await SeedAsync(app);
app.MapGet("/", ()=> Results.Ok(new { service = "ai-insights-service", store = "clickhouse-ready-boundary" }));
app.MapGet("/api/v1/insights/students/{studentId:guid}", async (Guid studentId, InsightsDbContext db) =>
    await db.StudentInsights.FirstOrDefaultAsync(x => x.StudentId == studentId) is { } item ? Results.Ok(item) : Results.NotFound());
app.MapGet("/api/v1/insights/summary", async (InsightsDbContext db) => await db.StudentInsights.ToListAsync()).RequireRoles("Principal", "Admin", "DepartmentHead");
app.Run();
static async Task SeedAsync(WebApplication app){ using var s=app.Services.CreateScope(); var db=s.ServiceProvider.GetRequiredService<InsightsDbContext>(); if(await db.StudentInsights.AnyAsync()) return; db.StudentInsights.Add(new StudentInsight{Id=Guid.NewGuid(),StudentId=Guid.Parse("00000000-0000-0000-0000-000000000123"),DropoutRisk="Low",AttendanceRisk="Medium",PerformanceSummary="Stable GPA with one attendance concern in Physics."}); await db.SaveChangesAsync(); }
public sealed class StudentInsight{ public Guid Id{get;set;} public Guid StudentId{get;set;} public string DropoutRisk{get;set;}=""; public string AttendanceRisk{get;set;}=""; public string PerformanceSummary{get;set;}=""; }
public sealed class InsightsDbContext(DbContextOptions<InsightsDbContext> options):DbContext(options){ public DbSet<StudentInsight> StudentInsights=>Set<StudentInsight>(); }
