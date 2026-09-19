package com.mordi.backend.service;

import com.mordi.backend.dto.NoteRequest;
import com.mordi.backend.exception.NoteLimitReachedException;
import com.mordi.backend.exception.NoteNotFoundException;
import com.mordi.backend.model.Note;
import com.mordi.backend.model.User;
import com.mordi.backend.repository.NoteRepository;
import com.mordi.backend.repository.UserRepository;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class NoteServiceTest {

    private static final String ME = "me@mordi.com";
    private static final String THEM = "them@mordi.com";

    @Mock private NoteRepository noteRepository;
    @Mock private UserRepository userRepository;

    private NoteService noteService;
    private User me;
    private User them;

    @BeforeEach
    void setUp() {
        noteService = new NoteService(noteRepository, userRepository);
        me = user(1L, ME);
        them = user(2L, THEM);
        when(userRepository.findByEmail(ME)).thenReturn(Optional.of(me));
        when(noteRepository.save(any(Note.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    private static User user(Long id, String email) {
        User user = new User();
        user.setId(id);
        user.setEmail(email);
        user.setName("Someone");
        return user;
    }

    private static NoteRequest request(String title, String body) {
        NoteRequest request = new NoteRequest();
        request.setTitle(title);
        request.setBody(body);
        return request;
    }

    private Note existing(Long id, User owner) {
        Note note = new Note();
        note.setId(id);
        note.setUser(owner);
        note.setTitle("Old title");
        note.setBody("Old body");
        return note;
    }

    @Nested
    class TheCap {

        @Test
        void allowsANoteWhileUnderTheLimit() {
            when(noteRepository.countByUser(me)).thenReturn((long) NoteService.MAX_NOTES - 1);

            Note note = noteService.createNote(ME, request(null, "Buy cat food"));

            assertThat(note.getBody()).isEqualTo("Buy cat food");
            verify(noteRepository).save(any(Note.class));
        }

        @Test
        void refusesAtTheLimitAndSavesNothing() {
            when(noteRepository.countByUser(me)).thenReturn((long) NoteService.MAX_NOTES);

            assertThatThrownBy(() -> noteService.createNote(ME, request(null, "One more")))
                .isInstanceOf(NoteLimitReachedException.class)
                .hasMessageContaining(String.valueOf(NoteService.MAX_NOTES));

            verify(noteRepository, never()).save(any());
        }

        @Test
        void refusesIfTheCountIsSomehowAlreadyOverTheLimit() {
            when(noteRepository.countByUser(me)).thenReturn((long) NoteService.MAX_NOTES + 50);

            assertThatThrownBy(() -> noteService.createNote(ME, request(null, "One more")))
                .isInstanceOf(NoteLimitReachedException.class);
        }

        @Test
        void doesNotApplyToEditingAnExistingNote() {
            // Editing at the cap has to keep working, or a full set of notes
            // becomes read-only.
            when(noteRepository.countByUser(me)).thenReturn((long) NoteService.MAX_NOTES);
            when(noteRepository.findById(7L)).thenReturn(Optional.of(existing(7L, me)));

            Note note = noteService.updateNote(ME, 7L, request(null, "Edited"));

            assertThat(note.getBody()).isEqualTo("Edited");
        }
    }

    @Nested
    class Content {

        @Test
        void trimsTheBodyAndDropsAnEmptyTitle() {
            Note note = noteService.createNote(ME, request("   ", "   Water the plants   "));

            assertThat(note.getBody()).isEqualTo("Water the plants");
            assertThat(note.getTitle()).isNull();
        }

        @Test
        void refusesANoteWithNothingInIt() {
            assertThatThrownBy(() -> noteService.createNote(ME, request("Title only", "   ")))
                .isInstanceOf(IllegalArgumentException.class);
            assertThatThrownBy(() -> noteService.createNote(ME, request("Title only", null)))
                .isInstanceOf(IllegalArgumentException.class);

            verify(noteRepository, never()).save(any());
        }

        @Test
        void clampsAnOverlongTitleAndBodyRatherThanFailing() {
            Note note = noteService.createNote(ME, request("t".repeat(400), "b".repeat(25_000)));

            assertThat(note.getTitle()).hasSize(120);
            assertThat(note.getBody()).hasSize(20_000);
        }

        @Test
        void defaultsToUnpinned() {
            assertThat(noteService.createNote(ME, request(null, "Something")).isPinned())
                .isFalse();
        }

        @Test
        void aMissingFieldOnUpdateLeavesTheStoredValueAlone() {
            when(noteRepository.findById(7L)).thenReturn(Optional.of(existing(7L, me)));

            Note note = noteService.updateNote(ME, 7L, request(null, null));

            assertThat(note.getTitle()).isEqualTo("Old title");
            assertThat(note.getBody()).isEqualTo("Old body");
        }

        @Test
        void anExplicitlyEmptyTitleOnUpdateClearsIt() {
            when(noteRepository.findById(7L)).thenReturn(Optional.of(existing(7L, me)));

            assertThat(noteService.updateNote(ME, 7L, request("", null)).getTitle()).isNull();
        }
    }

    @Nested
    class Ownership {

        @Test
        void editingANoteBelongingToAnotherUserIsReportedAsNotFound() {
            when(noteRepository.findById(9L)).thenReturn(Optional.of(existing(9L, them)));

            assertThatThrownBy(() -> noteService.updateNote(ME, 9L, request(null, "Mine now")))
                .isInstanceOf(NoteNotFoundException.class)
                .hasMessage("Note not found");

            verify(noteRepository, never()).save(any());
        }

        @Test
        void deletingANoteBelongingToAnotherUserIsReportedAsNotFound() {
            when(noteRepository.findById(9L)).thenReturn(Optional.of(existing(9L, them)));

            assertThatThrownBy(() -> noteService.deleteNote(ME, 9L))
                .isInstanceOf(NoteNotFoundException.class);

            verify(noteRepository, never()).delete(any());
        }

        @Test
        void aMissingNoteIsReportedExactlyLikeOneOwnedByAnotherUser() {
            when(noteRepository.findById(404L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> noteService.updateNote(ME, 404L, request(null, "x")))
                .isInstanceOf(NoteNotFoundException.class)
                .hasMessage("Note not found");
        }

        @Test
        void deletingOwnNoteRemovesIt() {
            Note mine = existing(7L, me);
            when(noteRepository.findById(7L)).thenReturn(Optional.of(mine));

            noteService.deleteNote(ME, 7L);

            verify(noteRepository).delete(mine);
        }
    }

    @Nested
    class Listing {

        @Test
        void asksForPinnedFirstThenMostRecentlyEdited() {
            List<Note> mine = List.of(existing(1L, me));
            when(noteRepository.findByUserOrderByPinnedDescUpdatedAtDesc(me)).thenReturn(mine);

            assertThat(noteService.getNotes(ME)).isSameAs(mine);
        }
    }
}
