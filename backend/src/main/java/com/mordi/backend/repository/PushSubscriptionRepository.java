package com.mordi.backend.repository;

import com.mordi.backend.model.PushSubscription;
import com.mordi.backend.model.User;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PushSubscriptionRepository extends JpaRepository<PushSubscription, Long> {
    List<PushSubscription> findByUser(User user);
    Optional<PushSubscription> findByEndpoint(String endpoint);
    long countByUser(User user);
}
