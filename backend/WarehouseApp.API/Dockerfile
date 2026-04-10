FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy solution and project files
COPY WarehouseApp.sln .
COPY WarehouseApp.API/WarehouseApp.API.csproj WarehouseApp.API/
COPY WarehouseApp.Application/WarehouseApp.Application.csproj WarehouseApp.Application/
COPY WarehouseApp.Domain/WarehouseApp.Domain.csproj WarehouseApp.Domain/
COPY WarehouseApp.Infrastructure/WarehouseApp.Infrastructure.csproj WarehouseApp.Infrastructure/

# Restore dependencies
RUN dotnet restore WarehouseApp.API/WarehouseApp.API.csproj

# Copy all source code
COPY . .

# Build
RUN dotnet publish WarehouseApp.API/WarehouseApp.API.csproj -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

RUN mkdir -p /app/logs

COPY --from=build /app/publish .

EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production

ENTRYPOINT ["dotnet", "WarehouseApp.API.dll"]
