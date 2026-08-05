using System.Security.Cryptography;
using CoreApi.Models;
using Microsoft.AspNetCore.Http;

namespace CoreApi.Services
{
    public interface ITokenService
    {
        string CreateAccessToken(User user, string sessionId);
        (string rawToken, RefreshToken entity) GenerateRefreshToken(int userId, string sessionId);
        void SetAuthCookies(HttpResponse response, string accessToken, string refreshToken);
        void ClearAuthCookies(HttpResponse response);
    }
}