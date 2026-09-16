package com.mordi.backend.service;

import com.mordi.backend.dto.NoteRequest;
import com.mordi.backend.exception.NoteLimitReachedException;
import com.mordi.backend.exception.NoteNotFoundException;
import com.mordi.backend.model.Note;
import com.mordi.backend.model.User;
import com.mordi.backend.repository.NoteRepository;
import com.mordi.backend.repository.UserRepository;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * Notes, capped per user.
 *
 * The cap lives here rather than in a database constraint: counting rows in a
 * check constraint needs a trigger, and this is where the message a person
 * actually reads belongs.
 */
@Service
@RequiredArgsConstructor
public class NoteService {

    /** Deliberately small. Notes are for a handful of standing reminders. */
    public static final int MAX_NOTES = 5;

    /** Long enough for a paragraph, short enough that it is still a note. */
    private static final int MAX_BODY = 2000;
    private static final int MAX_TITLE = 120;

    private final NoteRepository noteRepository;
    private final UserRepository userRepository;

    public List<Note> getNotes(String email) {
        return noteRepository.findByUserOrderByPinnedDescUpdatedAtDesc(findUser(email));
    }

    public Note createNote(String email, NoteRequest request) {
        User user = findUser(email);

        if (noteRepository.countByUser(user) >= MAX_NOTES) {
            throw new NoteLimitReachedException(MAX_NOTES);
        }

        Note note = new Note();
        note.setUser(user);
        note.setTitle(clamp(blankToNull(request.getTitle()), MAX_TITLE));
        note.setBody(requireBody(request.getBody()));
        note.setPinned(Boolean.TRUE.equals(request.getPinned()));

        return noteRepository.save(note);
    }

    public Note updateNote(String email, Long noteId, NoteRequest request) {
        Note note = findOwnedNote(email, noteId);

        // Title is clearable, so an explicitly empty value removes it; a
        // missing one leaves what is there alone.
        if (request.getTitle() != null) {
            note.setTitle(clamp(blankToNull(request.getTitle()), MAX_TITLE));
        }
        if (request.getBody() != null) {
            note.setBody(requireBody(request.getBody()));
        }
        if (request.getPinned() != null) {
            note.setPinned(request.getPinned());
        }

        return noteRepository.save(note);
    }

    public void deleteNote(String email, Long noteId) {
        // A hard delete, unlike goals: there is nothing downstream that
        // references a note, so archiving it would only hide it from the one
        // place it appears.
        noteRepository.delete(findOwnedNote(email, noteId));
    }

    /**
     * Notes belonging to someone else are reported exactly like notes that do
     * not exist, so ids from other accounts cannot be probed.
     */
    private Note findOwnedNote(String email, Long noteId) {
        return noteRepository
            .findById(noteId)
            .filter(note -> note.getUser().getEmail().equals(email))
            .orElseThrow(NoteNotFoundException::new);
    }

    private String requireBody(String body) {
        String trimmed = body == null ? "" : body.trim();
        if (trimmed.isEmpty()) {
            throw new IllegalArgumentException("A note needs something in it");
        }
        return clamp(trimmed, MAX_BODY);
    }

    private String clamp(String value, int max) {
        if (value == null) {
            return null;
        }
        return value.length() <= max ? value : value.substring(0, max);
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private User findUser(String email) {
        return userRepository
            .findByEmail(email)
            .orElseThrow(() -> new RuntimeException("User not found"));
    }
}
