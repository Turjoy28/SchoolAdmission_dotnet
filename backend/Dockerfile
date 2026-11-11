FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY SchoolAdmission.Api/SchoolAdmission.Api.csproj SchoolAdmission.Api/
RUN dotnet restore SchoolAdmission.Api/SchoolAdmission.Api.csproj
COPY SchoolAdmission.Api/ SchoolAdmission.Api/
RUN dotnet publish SchoolAdmission.Api/SchoolAdmission.Api.csproj -c Release -o /app

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS test
WORKDIR /src
COPY . .
ENTRYPOINT ["dotnet", "test", "SchoolAdmission.Tests/SchoolAdmission.Tests.csproj"]

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app .
ENV ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "SchoolAdmission.Api.dll"]
