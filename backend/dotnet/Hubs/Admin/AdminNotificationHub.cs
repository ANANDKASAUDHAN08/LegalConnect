using System.Threading.Tasks;
using Microsoft.AspNetCore.SignalR;

namespace CoreApi.Hubs.Admin
{
    /// <summary>
    /// Real-time admin notification hub for pushing security and telemetry alerts via WebSocket.
    /// Admin clients join the "Admins" group on connection to receive instant notifications.
    /// </summary>
    public class AdminNotificationHub : Hub
    {
        /// <summary>
        /// Called by admin clients to subscribe to real-time admin notifications.
        /// </summary>
        public async Task JoinAdminGroup()
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, "Admins");
        }

        /// <summary>
        /// Called by admin clients to leave the admin notifications group.
        /// </summary>
        public async Task LeaveAdminGroup()
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, "Admins");
        }

        public override async Task OnConnectedAsync()
        {
            // Auto-join admins to the Admins group on connection
            await Groups.AddToGroupAsync(Context.ConnectionId, "Admins");
            await base.OnConnectedAsync();
        }
    }
}