package com.mordi.backend.repository;

import com.mordi.backend.model.RefreshToken;
import com.mordi.backend.model.User;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {

    Optional<RefreshToken> findByTokenHash(String tokenHash);

    /** Ends every session descended from one sign-in. */
    @Modifying
    @Query("update RefreshToken t set t.revokedAt = :now "
         + "where t.familyId = :familyId and t.revokedAt is null")
    int revokeFamily(@Param("familyId") UUID familyId, @Param("now") LocalDateTime now);

    /** Ends every session one person has, on every device. */
    @Modifying
    @Query("update RefreshToken t set t.revokedAt = :now "
         + "where t.user = :user and t.revokedAt is null")
    int revokeAllForUser(@Param("user") User user, @Param("now") LocalDateTime now);
}
