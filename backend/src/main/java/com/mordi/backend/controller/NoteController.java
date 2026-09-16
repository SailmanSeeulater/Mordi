package com.mordi.backend.controller;

import com.mordi.backend.dto.NoteRequest;
import com.mordi.backend.model.Note;
import com.mordi.backend.service.NoteService;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/notes")
@RequiredArgsConstructor
public class NoteController {

    private final NoteService noteService;

    @GetMapping
    public ResponseEntity<List<Note>> getNotes(@AuthenticationPrincipal String email) {
        return ResponseEntity.ok(noteService.getNotes(email));
    }

    /** How many a user may keep, so the client does not hardcode the number. */
    @GetMapping("/limit")
    public ResponseEntity<Map<String, Integer>> getLimit() {
        return ResponseEntity.ok(Map.of("maxNotes", NoteService.MAX_NOTES));
    }

    @PostMapping
    public ResponseEntity<Note> createNote(
            @AuthenticationPrincipal String email,
            @RequestBody NoteRequest request) {
        return ResponseEntity.ok(noteService.createNote(email, request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Note> updateNote(
            @AuthenticationPrincipal String email,
            @PathVariable Long id,
            @RequestBody NoteRequest request) {
        return ResponseEntity.ok(noteService.updateNote(email, id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteNote(
            @AuthenticationPrincipal String email,
            @PathVariable Long id) {
        noteService.deleteNote(email, id);
        return ResponseEntity.noContent().build();
    }
}
