from django.core.files.storage import Storage, storages
from django.utils.deconstruct import deconstructible


@deconstructible
class _AliasedStorage(Storage):
    def _storage_for_name(self, name):
        raise NotImplementedError

    def _open(self, name, mode="rb"):
        return self._storage_for_name(name).open(name, mode)

    def _save(self, name, content):
        return self._storage_for_name(name).save(name, content)

    def delete(self, name):
        return self._storage_for_name(name).delete(name)

    def exists(self, name):
        return self._storage_for_name(name).exists(name)

    def listdir(self, path):
        return self._storage_for_name(path).listdir(path)

    def size(self, name):
        return self._storage_for_name(name).size(name)

    def url(self, name):
        return self._storage_for_name(name).url(name)

    def get_available_name(self, name, max_length=None):
        return self._storage_for_name(name).get_available_name(
            name,
            max_length=max_length,
        )


@deconstructible
class PostMediaStorage(_AliasedStorage):
    def _storage_for_name(self, name):
        normalized_name = name.replace("\\", "/").lstrip("/")
        if normalized_name.startswith(("posts/oci/", "posts/videos/oci/")):
            return storages["oracle_media"]
        return storages["default"]


@deconstructible
class ChatMediaStorage(_AliasedStorage):
    def _storage_for_name(self, name):
        normalized_name = name.replace("\\", "/").lstrip("/")
        if not normalized_name.startswith("chat/"):
            return storages["default"]
        return storages["oracle_media"]


@deconstructible
class MediaAssetStorage(_AliasedStorage):
    def _storage_for_name(self, name):
        normalized_name = name.replace("\\", "/").lstrip("/")
        if normalized_name.startswith("posts/"):
            return storages["oracle_media"]
        return storages["default"]
