import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateMe, uploadImage, type User } from "../api";

export function useProfileEditor(user: User | undefined, onSaved: () => void) {
    const queryClient = useQueryClient();
    const [profileDisplayName, setProfileDisplayName] = useState("");
    const [profileAvatarUrl, setProfileAvatarUrl] = useState("");
    const [profileBio, setProfileBio] = useState("");
    const [profileStatusText, setProfileStatusText] = useState("");

    const updateProfileMutation = useMutation({
        mutationFn: async () => {
            return updateMe({
                displayName: profileDisplayName,
                avatarUrl: profileAvatarUrl,
                bio: profileBio,
                statusText: profileStatusText
            });
        },
        onSuccess: async (data) => {
            queryClient.setQueryData(["me"], data);
            setProfileDisplayName(data.user.displayName);
            setProfileAvatarUrl(data.user.avatarUrl ?? "");
            setProfileBio(data.user.bio ?? "");
            setProfileStatusText(data.user.statusText ?? "");
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ["users"] }),
                queryClient.invalidateQueries({ queryKey: ["room-users"] }),
                queryClient.invalidateQueries({ queryKey: ["thread-members"] }),
                queryClient.invalidateQueries({ queryKey: ["messages"] }),
                queryClient.invalidateQueries({ queryKey: ["mention-notifications"] }),
                queryClient.invalidateQueries({ queryKey: ["whispers"] })
            ]);
            onSaved();
        }
    });

    const uploadProfileImageMutation = useMutation({
        mutationFn: (file: File) => uploadImage(file),
        onSuccess: (data) => {
            setProfileAvatarUrl(data.url);
        }
    });

    useEffect(() => {
        if (!user) return;

        setProfileDisplayName(user.displayName ?? "");
        setProfileAvatarUrl(user.avatarUrl ?? "");
        setProfileBio(user.bio ?? "");
        setProfileStatusText(user.statusText ?? "");
    }, [user]);

    return {
        profileDisplayName, setProfileDisplayName,
        profileAvatarUrl, setProfileAvatarUrl,
        profileBio, setProfileBio,
        profileStatusText, setProfileStatusText,
        updateProfileMutation, uploadProfileImageMutation
    };
}
