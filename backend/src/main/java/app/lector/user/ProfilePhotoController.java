package app.lector.user;

import app.lector.storage.PhotoType;
import java.time.Duration;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api")
public class ProfilePhotoController {

    private final CurrentUser currentUser;
    private final ProfilePhotoService photos;
    private final PlanService plans;
    private final Admins admins;

    public ProfilePhotoController(CurrentUser currentUser, ProfilePhotoService photos, PlanService plans,
                                  Admins admins) {
        this.currentUser = currentUser;
        this.photos = photos;
        this.plans = plans;
        this.admins = admins;
    }

    @PostMapping(value = "/me/photo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Transactional
    public MeDto upload(@AuthenticationPrincipal AuthUser principal, @RequestParam("file") MultipartFile file) {
        User user = currentUser.load(principal);
        photos.upload(user, file);
        return MeDto.of(user, plans, admins);
    }

    @DeleteMapping("/me/photo")
    @Transactional
    public MeDto remove(@AuthenticationPrincipal AuthUser principal) {
        User user = currentUser.load(principal);
        photos.remove(user);
        return MeDto.of(user, plans, admins);
    }

    @GetMapping("/users/{id}/photo")
    public ResponseEntity<Resource> photo(@PathVariable Long id) {
        ProfilePhotoService.Photo photo = photos.load(id);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(PhotoType.mediaType(photo.name())))
                .cacheControl(CacheControl.maxAge(Duration.ofDays(365)).cachePrivate())
                .body(photo.file());
    }
}
