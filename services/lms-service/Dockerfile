FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

COPY Directory.Build.props Directory.Packages.props Colllege-Software.sln ./
COPY services/building-blocks/University360.BuildingBlocks/University360.BuildingBlocks.csproj services/building-blocks/University360.BuildingBlocks/
COPY services/lms-service/src/LmsService.Api/LmsService.Api.csproj services/lms-service/src/LmsService.Api/
RUN dotnet restore services/lms-service/src/LmsService.Api/LmsService.Api.csproj

COPY services/building-blocks/University360.BuildingBlocks/ services/building-blocks/University360.BuildingBlocks/
COPY services/lms-service/src/LmsService.Api/ services/lms-service/src/LmsService.Api/
RUN dotnet publish services/lms-service/src/LmsService.Api/LmsService.Api.csproj -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:9.0
WORKDIR /app
COPY --from=build /app/publish .
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "LmsService.Api.dll"]
