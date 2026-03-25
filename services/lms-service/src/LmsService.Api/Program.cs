using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using University360.BuildingBlocks;
var builder = WebApplication.CreateBuilder(args);
builder.AddPlatformDefaults<LmsDbContext>();
var app = builder.Build();
app.UsePlatformDefaults();
await app.EnsureDatabaseReadyAsync<LmsDbContext>();
await SeedAsync(app);
app.MapGet("/",()=>Results.Ok(new{service="lms-service",status="ready"}));
app.MapGet("/api/v1/materials", async (LmsDbContext db)=> await db.Materials.ToListAsync());
app.MapGet("/api/v1/assignments", async (LmsDbContext db)=> await db.Assignments.ToListAsync());
app.MapPost("/api/v1/assignments/upload", async (HttpRequest request, LmsDbContext db) =>
{
    var form = await request.ReadFormAsync();
    var file = form.Files.FirstOrDefault();
    var assignment = new AssignmentItem { Id = Guid.NewGuid(), Title = form["title"].FirstOrDefault() ?? "Uploaded Assignment", FileName = file?.FileName ?? "nofile", UploadedAtUtc = DateTimeOffset.UtcNow };
    db.Assignments.Add(assignment);
    await db.SaveChangesAsync();
    return Results.Created($"/api/v1/assignments/{assignment.Id}", assignment);
}).RequireRoles("Professor", "Admin");
app.Run();
static async Task SeedAsync(WebApplication app){ using var s=app.Services.CreateScope(); var db=s.ServiceProvider.GetRequiredService<LmsDbContext>(); if(await db.Materials.AnyAsync()) return; db.Materials.Add(new CourseMaterial{Id=Guid.NewGuid(),CourseCode="CSE401",Title="Week 1 Slides"}); db.Assignments.Add(new AssignmentItem{Id=Guid.NewGuid(),Title="Distributed Systems Lab 1",FileName="lab1.pdf",UploadedAtUtc=DateTimeOffset.UtcNow.AddDays(-3)}); await db.SaveChangesAsync(); }
public sealed class CourseMaterial{ public Guid Id{get;set;} public string CourseCode{get;set;}=""; public string Title{get;set;}=""; }
public sealed class AssignmentItem{ public Guid Id{get;set;} public string Title{get;set;}=""; public string FileName{get;set;}=""; public DateTimeOffset UploadedAtUtc{get;set;} }
public sealed class LmsDbContext(DbContextOptions<LmsDbContext> options):DbContext(options){ public DbSet<CourseMaterial> Materials=>Set<CourseMaterial>(); public DbSet<AssignmentItem> Assignments=>Set<AssignmentItem>(); }
