package com.mordi.backend;

import java.lang.reflect.Constructor;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.type.filter.AnnotationTypeFilter;
import org.springframework.stereotype.Component;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Every Spring bean in the application can be constructed by injection.
 *
 * Unit tests call constructors directly, so they never notice when Spring
 * cannot. That is how RefreshTokenService shipped with two constructors and no
 * @Autowired: every test passed, and the application failed to start with
 * NoSuchMethodException, because with several constructors and none marked,
 * Spring falls back to a no-argument one that did not exist.
 *
 * This runs in milliseconds with no database and no application context, so
 * it guards the rule even though the full context test is disabled.
 */
class BeanConstructorTest {

    @Test
    void everyBeanHasOneConstructorSpringCanUse() throws Exception {
        ClassPathScanningCandidateComponentProvider scanner =
            new ClassPathScanningCandidateComponentProvider(false);
        // @Service, @Repository, @Controller and @RestController are all
        // meta-annotated with @Component, so this finds every stereotype.
        scanner.addIncludeFilter(new AnnotationTypeFilter(Component.class));

        List<String> problems = new ArrayList<>();
        int checked = 0;

        for (BeanDefinition definition : scanner.findCandidateComponents("com.mordi.backend")) {
            Class<?> type = Class.forName(definition.getBeanClassName());
            if (type.isInterface()) {
                continue;
            }
            checked++;

            Constructor<?>[] constructors = type.getDeclaredConstructors();
            if (constructors.length == 1) {
                continue;
            }
            long marked = Arrays.stream(constructors)
                .filter(c -> c.isAnnotationPresent(Autowired.class))
                .count();
            boolean hasNoArg = Arrays.stream(constructors).anyMatch(c -> c.getParameterCount() == 0);

            if (marked > 1) {
                problems.add(type.getSimpleName() + " has " + marked + " @Autowired constructors");
            } else if (marked == 0 && !hasNoArg) {
                problems.add(type.getSimpleName() + " has " + constructors.length
                    + " constructors, none marked @Autowired and no no-argument one");
            }
        }

        // Guards against the scan silently finding nothing, which would pass.
        assertThat(checked).as("beans scanned").isGreaterThan(10);
        assertThat(problems).as("beans Spring cannot construct").isEmpty();
    }
}
