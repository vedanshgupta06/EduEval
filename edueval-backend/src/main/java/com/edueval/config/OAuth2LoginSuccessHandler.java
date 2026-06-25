package com.edueval.config;

import com.edueval.entity.User;
import com.edueval.enums.Role;
import com.edueval.repository.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;

@Component
@RequiredArgsConstructor
public class OAuth2LoginSuccessHandler implements AuthenticationSuccessHandler {

    private final JwtUtil jwtUtil;
    private final UserRepository userRepository;

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request,
                                        HttpServletResponse response,
                                        Authentication authentication) throws IOException {

        OAuth2User oAuth2User = (OAuth2User) authentication.getPrincipal();
        String email = oAuth2User.getAttribute("email");
        String name = oAuth2User.getAttribute("name");

        boolean isNewUser = !userRepository.findByEmail(email).isPresent();

        User user = userRepository.findByEmail(email).orElseGet(() -> {
            User newUser = User.builder()
                    .name(name)
                    .email(email)
                    .passwordHash(null)
                    .role(Role.STUDENT)
                    .build();
            return userRepository.save(newUser);
        });

        String jwt = jwtUtil.generateToken(user.getEmail());

        String redirectUrl = isNewUser
                ? "https://edu-eval-rho.vercel.app/oauth2/callback?token=" + jwt + "&newUser=true"
                : "https://edu-eval-rho.vercel.app/oauth2/callback?token=" + jwt;

        response.sendRedirect(redirectUrl);
    }
}