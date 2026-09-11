using System.Collections.Generic;
using CoreApi.Models;

namespace CoreApi.Constants
{
    /// <summary>
    /// Shared SLA threshold constants used by both the background SLA escalation worker
    /// and the manual auto-escalation controller endpoint.
    /// 
    /// Centralizing these values ensures SLA policy changes propagate uniformly
    /// across all enforcement surfaces (daemon sweep + admin-triggered scan).
    /// 
    /// Thresholds represent the maximum hours a report can remain unresolved
    /// at each severity tier before automatic escalation to Critical.
    /// </summary>
    public static class ModerationSlaConstants
    {
        public static readonly Dictionary<ReportSeverity, double> SlaThresholds = new()
        {
            { ReportSeverity.Critical, 4 },
            { ReportSeverity.High, 24 },
            { ReportSeverity.Medium, 48 },
            { ReportSeverity.Low, 72 }
        };

        /// <summary>
        /// The minimum SLA threshold in hours (High = 24h).
        /// Reports younger than this can never have breached any SLA tier.
        /// Used as a pre-filter optimization in database queries.
        /// </summary>
        public static readonly double MinThresholdHours = 24;
    }
}