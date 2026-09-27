using System.Text.RegularExpressions;

namespace CoreApi.Utils
{
    public static class PhoneNumberUtils
    {
        /// <summary>
        /// Normalizes phone numbers to standard E.164 international format (+[country][national_number]).
        /// Defaults 10-digit Indian numbers to +91.
        /// </summary>
        public static string NormalizeToE164(string? phone)
        {
            if (string.IsNullOrWhiteSpace(phone)) return string.Empty;
            var cleaned = Regex.Replace(phone.Trim(), @"[^\d+]", "");
            if (cleaned.StartsWith("+"))
            {
                return cleaned;
            }
            if (cleaned.Length == 10)
            {
                return "+91" + cleaned;
            }
            if (cleaned.StartsWith("91") && cleaned.Length == 12)
            {
                return "+" + cleaned;
            }
            return "+" + cleaned;
        }
    }
}