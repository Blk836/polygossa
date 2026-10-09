package app.lector.user;

import app.lector.common.ApiException;
import app.lector.storage.StorageService;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
public class ProfilePhotoService {

    public record Photo(String name, Resource file) {}

    private final UserRepository users;
    private final StorageService storage;

    public ProfilePhotoService(UserRepository users, StorageService storage) {
        this.users = users;
        this.storage = storage;
    }

    @Transactional
    public void upload(User user, MultipartFile file) {
        String old = user.getPhotoFile();
        user.setPhotoFile(storage.savePhoto(file));
        storage.delete(old);
    }

    @Transactional
    public void remove(User user) {
        storage.delete(user.getPhotoFile());
        user.setPhotoFile(null);
    }

    @Transactional(readOnly = true)
    public Photo load(Long userId) {
        String name = users.findById(userId).map(User::getPhotoFile)
                .orElseThrow(() -> ApiException.notFound("Photo"));
        return new Photo(name, storage.open(name, null, "Photo").body());
    }
}
