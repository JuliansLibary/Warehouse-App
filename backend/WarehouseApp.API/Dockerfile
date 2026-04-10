FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy solution and project files first for better layer caching
COPY WarehouseApp.sln .
COPY WarehouseApp.API/WarehouseApp.API.csproj WarehouseApp.API/
COPY WarehouseApp.Application/WarehouseApp.Application.csproj WarehouseApp.Application/
COPY WarehouseApp.Domain/WarehouseApp.Domain.csproj WarehouseApp.Domain/
COPY WarehouseApp.Infrastructure/WarehouseApp.Infrastructure.csproj WarehouseApp.Infrastructure/

RUN dotnet restore WarehouseApp.API/WarehouseApp.API.csproj

COPY . .
RUN dotnet publish WarehouseApp.API/WarehouseApp.API.csproj -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

# wget is used by docker-compose healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends wget && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /app/logs

COPY --from=build /app/publish .

EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget -qO- http://localhost:8080/health || exit 1

ENTRYPOINT ["dotnet", "WarehouseApp.API.dll"]
