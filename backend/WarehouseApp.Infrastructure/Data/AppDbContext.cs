using Microsoft.EntityFrameworkCore;
using WarehouseApp.Domain.Entities;

namespace WarehouseApp.Infrastructure.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Instance> Instances => Set<Instance>();
    public DbSet<Tenant> Tenants => Set<Tenant>();
    public DbSet<User> Users => Set<User>();
    public DbSet<Configuration> Configurations => Set<Configuration>();
    public DbSet<DocumentCache> DocumentCaches => Set<DocumentCache>();
    public DbSet<DocumentLock> DocumentLocks => Set<DocumentLock>();
    public DbSet<DocumentDetails> DocumentDetails => Set<DocumentDetails>();
    public DbSet<ItemCache> ItemCaches => Set<ItemCache>();
    public DbSet<MasterData> MasterData => Set<MasterData>();
    public DbSet<Printer> Printers => Set<Printer>();
    public DbSet<LabelTemplate> LabelTemplates => Set<LabelTemplate>();
    public DbSet<OfflineSyncEntry> OfflineSyncEntries => Set<OfflineSyncEntry>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Apply all entity configurations from assembly
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);

        // Composite primary keys
        modelBuilder.Entity<DocumentDetails>()
            .HasKey(d => new { d.DocEntry, d.Module, d.Method, d.TenantId });

        modelBuilder.Entity<ItemCache>()
            .HasKey(i => new { i.ItemCode, i.TenantId });

        modelBuilder.Entity<MasterData>()
            .HasKey(m => new { m.DataType, m.TenantId });

        // Cascade deletes
        modelBuilder.Entity<Tenant>()
            .HasOne(t => t.Instance)
            .WithMany(i => i.Tenants)
            .HasForeignKey(t => t.InstanceId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<User>()
            .HasOne(u => u.Instance)
            .WithMany(i => i.Users)
            .HasForeignKey(u => u.InstanceId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Configuration>()
            .HasOne(c => c.Tenant)
            .WithMany(t => t.Configurations)
            .HasForeignKey(c => c.TenantId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<DocumentCache>()
            .HasOne(c => c.Tenant)
            .WithMany(t => t.Caches)
            .HasForeignKey(c => c.TenantId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<DocumentLock>()
            .HasOne(l => l.Tenant)
            .WithMany(t => t.DocumentLocks)
            .HasForeignKey(l => l.TenantId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<DocumentDetails>()
            .HasOne(d => d.Tenant)
            .WithMany(t => t.DocumentDetails)
            .HasForeignKey(d => d.TenantId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<ItemCache>()
            .HasOne(i => i.Tenant)
            .WithMany(t => t.Items)
            .HasForeignKey(i => i.TenantId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<MasterData>()
            .HasOne(m => m.Tenant)
            .WithMany(t => t.MasterData)
            .HasForeignKey(m => m.TenantId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Printer>()
            .HasOne(p => p.Tenant)
            .WithMany(t => t.Printers)
            .HasForeignKey(p => p.TenantId)
            .OnDelete(DeleteBehavior.Cascade);

        // Indexes for performance
        modelBuilder.Entity<DocumentCache>()
            .HasIndex(c => new { c.DocumentNumber, c.Module, c.TenantId });

        modelBuilder.Entity<DocumentLock>()
            .HasIndex(l => new { l.DocumentNumber, l.Module, l.TenantId });

        modelBuilder.Entity<User>()
            .HasIndex(u => u.IdentityId)
            .IsUnique();

        modelBuilder.Entity<Tenant>()
            .HasIndex(t => new { t.Name, t.InstanceId })
            .IsUnique();

        modelBuilder.Entity<AuditLog>()
            .HasIndex(a => new { a.TenantId, a.CreatedAt });
    }

    public override Task<int> SaveChangesAsync(CancellationToken ct = default)
    {
        UpdateTimestamps();
        return base.SaveChangesAsync(ct);
    }

    private void UpdateTimestamps()
    {
        var now = DateTime.UtcNow;
        foreach (var entry in ChangeTracker.Entries<BaseEntity>())
        {
            if (entry.State == EntityState.Added)
                entry.Entity.CreatedAt = now;
            if (entry.State is EntityState.Added or EntityState.Modified)
                entry.Entity.UpdatedAt = now;
        }
    }
}
