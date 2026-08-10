using System;
using System.Collections.Generic;
using System.Text.RegularExpressions;

namespace CoreApi.Services
{
    public class PiiSanitizerService : IPiiSanitizerService
    {
        // Compiled Regex Patterns for optimal performance & thread safety
        private static readonly Regex EmailRegex = new(
            @"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b",
            RegexOptions.Compiled | RegexOptions.IgnoreCase);

        private static readonly Regex PhoneRegex = new(
            @"(?:\+?\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b|\b[6-9]\d{9}\b|\b\d{10,11}\b",
            RegexOptions.Compiled);

        private static readonly Regex DocketRegex = new(
            @"\b(?:FIR|F\.I\.R\.|WP\(C\)|SLP\(C\)|CRL\.A\.|SUIT|CASE|DOCKET|PETITION|APPEAL)\s*(?:NO\.?|#)?\s*[A-Z0-9/\.-]+\b",
            RegexOptions.Compiled | RegexOptions.IgnoreCase);

        private static readonly Regex FinancialRegex = new(
            @"(?:\$|₹|Rs\.?|INR|USD)\s*\d+(?:,\d+)*(?:\.\d{1,2})?|\b\d+(?:[\.,]\d+)*\s*(?:lakhs?|crores?|thousands?|million|billion|usd|inr)\b",
            RegexOptions.Compiled | RegexOptions.IgnoreCase);

        private static readonly Regex PanCardRegex = new(
            @"\b[A-Z]{5}\d{4}[A-Z]\b",
            RegexOptions.Compiled);

        private static readonly Regex AadhaarRegex = new(
            @"\b[2-9]\d{3}\s\d{4}\s\d{4}\b",
            RegexOptions.Compiled);

        private static readonly Regex SsnRegex = new(
            @"\b\d{3}-\d{2}-\d{4}\b",
            RegexOptions.Compiled);

        public PiiSanitizeResult Sanitize(string input)
        {
            var result = new PiiSanitizeResult();
            if (string.IsNullOrWhiteSpace(input))
            {
                result.SanitizedText = input ?? string.Empty;
                return result;
            }

            string text = input;
            var detectedTypesSet = new HashSet<string>();

            // 1. Email Addresses
            if (EmailRegex.IsMatch(text))
            {
                text = EmailRegex.Replace(text, "");
                detectedTypesSet.Add("Email Address");
            }

            // 2. Case Docket / FIR Numbers
            if (DocketRegex.IsMatch(text))
            {
                text = DocketRegex.Replace(text, "");
                detectedTypesSet.Add("Case Docket/FIR");
            }

            // 3. Financial Figures & Settlement Amounts
            if (FinancialRegex.IsMatch(text))
            {
                text = FinancialRegex.Replace(text, "");
                detectedTypesSet.Add("Financial Figure");
            }

            // 4. PAN Card
            if (PanCardRegex.IsMatch(text))
            {
                text = PanCardRegex.Replace(text, "");
                detectedTypesSet.Add("PAN Number");
            }

            // 5. Aadhaar
            if (AadhaarRegex.IsMatch(text))
            {
                text = AadhaarRegex.Replace(text, "");
                detectedTypesSet.Add("Aadhaar Number");
            }

            // 6. SSN
            if (SsnRegex.IsMatch(text))
            {
                text = SsnRegex.Replace(text, "");
                detectedTypesSet.Add("SSN");
            }

            // 7. Phone Numbers (Run after docket & financial to prevent collision)
            if (PhoneRegex.IsMatch(text))
            {
                text = PhoneRegex.Replace(text, "");
                detectedTypesSet.Add("Phone Number");
            }

            // Clean up double spaces & trailing/leading punctuation space
            text = Regex.Replace(text, @"\s+", " ");
            text = Regex.Replace(text, @"\s+([,\.\?!])", "$1");
            text = text.Trim();

            result.HasPii = detectedTypesSet.Count > 0;
            result.SanitizedText = text;
            result.DetectedTypes.AddRange(detectedTypesSet);

            return result;
        }
    }
}