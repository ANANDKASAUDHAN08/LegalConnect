using System;
using System.Security.Cryptography;
using System.Text;

namespace CoreApi.Services
{
    public static class TotpHelper
    {
        private static readonly string Base32Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

        /// <summary>
        /// Generates a cryptographically secure random Base32 secret key.
        /// </summary>
        public static string GenerateSecretKey(int length = 16)
        {
            byte[] randomBytes = new byte[length];
            using (var rng = RandomNumberGenerator.Create())
            {
                rng.GetBytes(randomBytes);
            }

            var sb = new StringBuilder(length);
            foreach (byte b in randomBytes)
            {
                sb.Append(Base32Alphabet[b % 32]);
            }
            return sb.ToString();
        }

        /// <summary>
        /// Decodes a Base32 encoded string to a byte array.
        /// </summary>
        public static byte[] Base32Decode(string input)
        {
            if (string.IsNullOrEmpty(input)) return Array.Empty<byte>();
            
            input = input.Trim().Replace("=", "").ToUpperInvariant();
            
            int byteCount = input.Length * 5 / 8;
            byte[] result = new byte[byteCount];
            
            int bitBuffer = 0;
            int bitLength = 0;
            int index = 0;
            
            foreach (char c in input)
            {
                int value = Base32Alphabet.IndexOf(c);
                if (value < 0) continue; // skip invalid chars
                
                bitBuffer = (bitBuffer << 5) | value;
                bitLength += 5;
                
                if (bitLength >= 8)
                {
                    bitLength -= 8;
                    if (index < byteCount)
                    {
                        result[index++] = (byte)(bitBuffer >> bitLength);
                    }
                    bitBuffer &= (1 << bitLength) - 1;
                }
            }
            
            return result;
        }

        /// <summary>
        /// Generates a 6-digit TOTP code for a given secret byte array and time step counter.
        /// </summary>
        public static int GenerateCode(byte[] secret, long timeStep)
        {
            byte[] challenge = BitConverter.GetBytes(timeStep);
            if (BitConverter.IsLittleEndian)
            {
                Array.Reverse(challenge); // network byte order (big endian) is required
            }

            using (var hmac = new HMACSHA1(secret))
            {
                byte[] hash = hmac.ComputeHash(challenge);
                int offset = hash[hash.Length - 1] & 0xf;
                int binary = ((hash[offset] & 0x7f) << 24)
                           | ((hash[offset + 1] & 0xff) << 16)
                           | ((hash[offset + 2] & 0xff) << 8)
                           | (hash[offset + 3] & 0xff);
                
                return binary % 1000000;
            }
        }

        /// <summary>
        /// Validates a TOTP code against a secret key within a specified clock drift window (±1 step / 30 seconds).
        /// </summary>
        public static bool ValidateCode(string secretBase32, string code, int window = 1)
        {
            if (string.IsNullOrEmpty(secretBase32) || string.IsNullOrEmpty(code)) return false;
            
            code = code.Trim();
            if (code.Length != 6 || !int.TryParse(code, out int parsedCode)) return false;

            byte[] secretBytes;
            try
            {
                secretBytes = Base32Decode(secretBase32);
            }
            catch
            {
                return false;
            }

            long currentTimeStep = DateTimeOffset.UtcNow.ToUnixTimeSeconds() / 30;

            for (int i = -window; i <= window; i++)
            {
                if (GenerateCode(secretBytes, currentTimeStep + i) == parsedCode)
                {
                    return true;
                }
            }

            return false;
        }
    }
}
