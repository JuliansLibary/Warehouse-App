namespace WarehouseApp.Application.DTOs;

// SAP Business One shared data types

public record SapWarehouse(
    string WarehouseCode,
    string WarehouseName,
    bool EnableBinLocations,
    string? DefaultBin
);

public record SapItem(
    string ItemCode,
    string ItemName,
    string ManageSerialNumbers,
    string ManageBatchNumbers,
    List<SapBarcode> ItemBarCodeCollection
);

public record SapBarcode(string Barcode, string UoMEntry);

public record SapBinLocation(
    int AbsEntry,
    string BinCode,
    string? BarCode,
    string? AlternativeSortCode,
    string WarehouseCode
);

public record SapSerialNumber(
    string InternalSerialNumber,
    string ManufacturerSerialNumber,
    int SystemSerialNumber,
    string? ItemCode,
    int? BinEntry
);

public record SapBatchNumber(
    string BatchNumber,
    string ItemCode,
    double Quantity,
    DateTime? ExpiryDate,
    int? BinEntry
);

public record SapBusinessPartner(
    string CardCode,
    string CardName,
    string CardType
);

public record SapPickList(
    int AbsoluteEntry,
    string PickDate,
    string ObjectType,
    string OwnerCode,
    List<SapPickListLine> PickListsLines
);

public record SapPickListLine(
    int AbsoluteEntry,
    int LineNumber,
    int OrderEntry,
    int OrderRowID,
    double ReleasedQuantity,
    double PreviouslyReleasedQuantity,
    double PickedQuantity,
    string PickStatus,
    int BaseObjectType
);

public record SapInventoryCounting(
    int DocumentEntry,
    string DocumentNumber,
    string CountDate,
    string DocumentStatus,
    List<SapInventoryCountingLine> InventoryCountingLines
);

public record SapInventoryCountingLine(
    int LineNumber,
    string ItemCode,
    string? ItemDescription,
    double CountedQuantity,
    string WarehouseCode,
    int? BinEntry,
    string ManageSerialNumbers,
    string ManageBatchNumbers
);

public record CheckSapCredentialsRequest(
    string UserName,
    string Password,
    string Database
);

public record SapCredentialsCheckResult(bool IsValid, string? ErrorMessage);

public record SapLoginSessionDto(
    string SessionToken,
    string UserId,
    long InstanceId,
    long TenantId,
    DateTime ExpiresAt
);
