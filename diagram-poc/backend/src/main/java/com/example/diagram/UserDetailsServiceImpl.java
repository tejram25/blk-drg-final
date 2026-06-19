package com.example.diagram;

import java.util.Collections;

import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

/**
 * Loads accounts from the database for Spring Security. Email is the login
 * identifier; accounts carry no authorities (no roles). An unverified account is
 * marked disabled, so sign-in fails with a DisabledException until it's verified.
 */
@Service
public class UserDetailsServiceImpl implements UserDetailsService {

    private final UserRepository users;

    public UserDetailsServiceImpl(UserRepository users) {
        this.users = users;
    }

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        String normalized = email == null ? "" : email.trim().toLowerCase();
        User user = users.findByEmail(normalized)
                .orElseThrow(() -> new UsernameNotFoundException("No account for " + email));

        return org.springframework.security.core.userdetails.User.builder()
                .username(user.getEmail())
                .password(user.getPassword())
                .disabled(!user.isEnabled())          // unverified => disabled
                .authorities(Collections.emptyList())  // no roles
                .build();
    }
}
