using Microsoft.EntityFrameworkCore;
using University360.BuildingBlocks;
var builder = WebApplication.CreateBuilder(args);
builder.AddPlatformDefaults<LibraryDbContext>();
var app = builder.Build();
app.UsePlatformDefaults();
await app.EnsureDatabaseReadyAsync<LibraryDbContext>();
await SeedAsync(app);
app.MapGet("/",()=>Results.Ok(new{service="library-service",status="ready"}));
app.MapGet("/api/v1/books", async (LibraryDbContext db)=> await db.Books.ToListAsync());
app.MapGet("/api/v1/borrowed", async (Guid? studentId, LibraryDbContext db)=> await db.Borrowings.Where(x => !studentId.HasValue || x.StudentId == studentId).ToListAsync());
app.Run();
static async Task SeedAsync(WebApplication app){ using var s=app.Services.CreateScope(); var db=s.ServiceProvider.GetRequiredService<LibraryDbContext>(); if(await db.Books.AnyAsync()) return; db.Books.Add(new LibraryBook{Id=Guid.NewGuid(),Title="Modern Distributed Systems",Author="Jane Doe",AvailableCopies=4}); db.Borrowings.Add(new BorrowRecord{Id=Guid.NewGuid(),StudentId=Guid.Parse("00000000-0000-0000-0000-000000000123"),BookTitle="Modern Distributed Systems",DueDateUtc=DateTimeOffset.UtcNow.AddDays(10)}); await db.SaveChangesAsync(); }
public sealed class LibraryBook{ public Guid Id{get;set;} public string Title{get;set;}=""; public string Author{get;set;}=""; public int AvailableCopies{get;set;} }
public sealed class BorrowRecord{ public Guid Id{get;set;} public Guid StudentId{get;set;} public string BookTitle{get;set;}=""; public DateTimeOffset DueDateUtc{get;set;} }
public sealed class LibraryDbContext(DbContextOptions<LibraryDbContext> options):DbContext(options){ public DbSet<LibraryBook> Books=>Set<LibraryBook>(); public DbSet<BorrowRecord> Borrowings=>Set<BorrowRecord>(); }
