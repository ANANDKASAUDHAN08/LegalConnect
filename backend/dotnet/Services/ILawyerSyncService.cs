using System.Threading.Tasks;

namespace CoreApi.Services
{
    public interface ILawyerSyncService
    {
        Task SyncProfileToMongoAsync(int userId);
        Task SyncAllProfilesToMongoAsync();
    }
}
