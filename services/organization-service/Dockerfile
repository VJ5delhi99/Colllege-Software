FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

COPY Directory.Build.props Directory.Packages.props Colllege-Software.sln ./
COPY services/building-blocks/University360.BuildingBlocks/University360.BuildingBlocks.csproj services/building-blocks/University360.BuildingBlocks/
COPY services/organization-service/src/OrganizationService.Api/OrganizationService.Api.csproj services/organization-service/src/OrganizationService.Api/
RUN dotnet restore services/organization-service/src/OrganizationService.Api/OrganizationService.Api.csproj

COPY services/building-blocks/University360.BuildingBlocks/ services/building-blocks/University360.BuildingBlocks/
COPY services/organization-service/src/OrganizationService.Api/ services/organization-service/src/OrganizationService.Api/
RUN dotnet publish services/organization-service/src/OrganizationService.Api/OrganizationService.Api.csproj -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:9.0
WORKDIR /app
COPY --from=build /app/publish .
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "OrganizationService.Api.dll"]
