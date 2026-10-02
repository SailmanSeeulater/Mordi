package com.mordi.backend.repository;

import com.mordi.backend.model.User;
import com.mordi.backend.model.UserToken;
import java.time.LocalDateTime;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface UserTokenRepository extends JpaRepository<UserToken, Long> {

    Optional<UserToken> findByTokenHash(String tokenHash);

    /** Retires every live token of one kind for one person. */
    @Modifying
    @Query("update UserToken t set t.usedAt = :now "
         + "where t.user = :user and t.purpose = :purpose and t.usedAt is null")
    int retireOutstanding(
        @Param("user") User user,
        @Param("purpose") UserToken.Purpose purpose,
        @Param("now") LocalDateTime now);
}
