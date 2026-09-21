using System;
using System.Security.Cryptography;

namespace CoreApi.Extensions
{
    /// <summary>
    /// Generates enterprise-grade, cryptographically secure non-sequential public identifiers.
    /// Follows the Stripe/Clerk/GitHub standard: {prefix}_{16-char-random-hex}.
    /// Example: usr_c74e89f210ad45b1, law_89f210ad45b1c74e, inq_10ad45b1c74e89f2
    /// </summary>
    public static class PublicIdGenerator
    {
        public static string Generate(string prefix)
        {
            Span<byte> bytes = stackalloc byte[8];
            RandomNumberGenerator.Fill(bytes);
            return $"{prefix}_{Convert.ToHexString(bytes).ToLowerInvariant()}";
        }
    }
}