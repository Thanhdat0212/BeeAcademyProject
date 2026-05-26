package com.beeacademy.backend.config;

import com.auth0.jwt.JWT;
import com.auth0.jwt.JWTVerifier;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.exceptions.JWTVerificationException;
import com.auth0.jwt.interfaces.DecodedJWT;
import com.beeacademy.backend.security.AuthenticatedUser;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.math.BigInteger;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.security.AlgorithmParameters;
import java.security.KeyFactory;
import java.security.interfaces.ECPublicKey;
import java.security.spec.ECGenParameterSpec;
import java.security.spec.ECParameterSpec;
import java.security.spec.ECPoint;
import java.security.spec.ECPublicKeySpec;
import java.util.Base64;
import java.util.List;
import java.util.UUID;

/**
 * Filter verify JWT Supabase, hỗ trợ hai thuật toán:
 * <ul>
 *   <li><b>ES256</b> (ECDSA P-256) — Supabase phiên bản mới mặc định dùng.
 *       Public key lấy từ JWKS endpoint khi khởi động.</li>
 *   <li><b>HS256</b> (HMAC-SHA256) — Supabase phiên bản cũ hoặc self-hosted.
 *       Dùng SUPABASE_JWT_SECRET đã base64-decode.</li>
 * </ul>
 *
 * <p>Thuật toán được chọn tự động theo claim {@code alg} trong JWT header.
 * Nếu không hỗ trợ thuật toán → skip (không set SecurityContext).
 */
@Slf4j
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final String BEARER_PREFIX = "Bearer ";

    private final JWTVerifier es256Verifier;  // nullable nếu JWKS fetch thất bại
    private final JWTVerifier hs256Verifier;

    public JwtAuthenticationFilter(SupabaseProperties props) {
        this.es256Verifier = buildEs256Verifier(props.url());
        this.hs256Verifier = buildHs256Verifier(props.jwtSecret());
    }

    // ========================================================================
    // FILTER LOGIC
    // ========================================================================

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        String token = extractBearerToken(request);

        if (token != null) {
            try {
                // Đọc alg từ header trước khi verify để chọn đúng verifier
                DecodedJWT unverified = JWT.decode(token);
                JWTVerifier verifier = selectVerifier(unverified.getAlgorithm());

                if (verifier != null) {
                    DecodedJWT decoded = verifier.verify(token);
                    AuthenticatedUser user = buildAuthenticatedUser(decoded);
                    setSecurityContext(user, request);
                    log.debug("Authenticated {} (alg={} role={})", user.userId(), unverified.getAlgorithm(), user.role());
                } else {
                    log.warn("Không có verifier cho JWT alg={}", unverified.getAlgorithm());
                }
            } catch (JWTVerificationException ex) {
                log.warn("JWT verification thất bại: {}", ex.getMessage());
            } catch (Exception ex) {
                log.error("Lỗi không xác định khi xử lý JWT", ex);
            }
        }

        filterChain.doFilter(request, response);
    }

    private JWTVerifier selectVerifier(String alg) {
        if ("ES256".equals(alg)) return es256Verifier;
        if ("HS256".equals(alg)) return hs256Verifier;
        return null;
    }

    // ========================================================================
    // BUILD VERIFIERS
    // ========================================================================

    /**
     * Lấy public key EC P-256 từ JWKS endpoint của Supabase và build verifier ES256.
     * Được gọi một lần khi khởi động. Trả null nếu không lấy được (không crash app).
     */
    private JWTVerifier buildEs256Verifier(String supabaseUrl) {
        try {
            String jwksUrl = supabaseUrl + "/auth/v1/.well-known/jwks.json";
            HttpClient http = HttpClient.newHttpClient();
            HttpRequest req = HttpRequest.newBuilder().uri(URI.create(jwksUrl)).GET().build();
            HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());

            JsonNode root = new ObjectMapper().readTree(resp.body());
            JsonNode keys = root.path("keys");

            for (JsonNode key : keys) {
                if (!"EC".equals(key.path("kty").asText())) continue;
                if (!"P-256".equals(key.path("crv").asText())) continue;

                ECPublicKey ecKey = parseEcPublicKey(
                        key.path("x").asText(),
                        key.path("y").asText()
                );
                Algorithm algorithm = Algorithm.ECDSA256(ecKey, null);
                log.info("ES256 verifier sẵn sàng (kid={})", key.path("kid").asText("n/a"));
                return JWT.require(algorithm).build();
            }

            log.warn("Không tìm thấy EC P-256 key trong JWKS của Supabase");
        } catch (Exception e) {
            log.warn("Không thể tải JWKS từ Supabase ({}). ES256 bị tắt.", e.getMessage());
        }
        return null;
    }

    private JWTVerifier buildHs256Verifier(String jwtSecret) {
        if (!StringUtils.hasText(jwtSecret)) {
            log.warn("SUPABASE_JWT_SECRET chưa cấu hình. HS256 bị tắt.");
            return null;
        }
        try {
            byte[] secretBytes = Base64.getDecoder().decode(jwtSecret);
            Algorithm algorithm = Algorithm.HMAC256(secretBytes);
            return JWT.require(algorithm).build();
        } catch (Exception e) {
            // Nếu decode base64 thất bại, thử dùng raw string bytes
            log.debug("Base64 decode JWT secret thất bại, thử raw bytes: {}", e.getMessage());
            Algorithm algorithm = Algorithm.HMAC256(jwtSecret);
            return JWT.require(algorithm).build();
        }
    }

    // ========================================================================
    // PARSE EC KEY
    // ========================================================================

    private ECPublicKey parseEcPublicKey(String xBase64Url, String yBase64Url) throws Exception {
        byte[] xBytes = Base64.getUrlDecoder().decode(xBase64Url);
        byte[] yBytes = Base64.getUrlDecoder().decode(yBase64Url);

        BigInteger x = new BigInteger(1, xBytes);
        BigInteger y = new BigInteger(1, yBytes);

        // P-256 = secp256r1
        AlgorithmParameters params = AlgorithmParameters.getInstance("EC");
        params.init(new ECGenParameterSpec("secp256r1"));
        ECParameterSpec ecSpec = params.getParameterSpec(ECParameterSpec.class);

        ECPoint point = new ECPoint(x, y);
        ECPublicKeySpec keySpec = new ECPublicKeySpec(point, ecSpec);
        return (ECPublicKey) KeyFactory.getInstance("EC").generatePublic(keySpec);
    }

    // ========================================================================
    // HELPERS
    // ========================================================================

    private String extractBearerToken(HttpServletRequest request) {
        String header = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (!StringUtils.hasText(header) || !header.startsWith(BEARER_PREFIX)) return null;
        return header.substring(BEARER_PREFIX.length()).trim();
    }

    private AuthenticatedUser buildAuthenticatedUser(DecodedJWT decoded) {
        UUID userId = UUID.fromString(decoded.getSubject());
        String email = safeClaim(decoded, "email");
        String role = extractRole(decoded);
        return new AuthenticatedUser(userId, email, role);
    }

    private String safeClaim(DecodedJWT decoded, String name) {
        return decoded.getClaim(name).isMissing() ? null : decoded.getClaim(name).asString();
    }

    @SuppressWarnings("unchecked")
    private String extractRole(DecodedJWT decoded) {
        try {
            var appMeta = decoded.getClaim("app_metadata");
            if (!appMeta.isMissing() && appMeta.asMap() != null) {
                Object role = appMeta.asMap().get("role");
                if (role instanceof String r && StringUtils.hasText(r)) return r;
            }
            var userMeta = decoded.getClaim("user_metadata");
            if (!userMeta.isMissing() && userMeta.asMap() != null) {
                Object role = userMeta.asMap().get("role");
                if (role instanceof String r && StringUtils.hasText(r)) return r;
            }
        } catch (Exception ignored) {}
        return safeClaim(decoded, "role");
    }

    private void setSecurityContext(AuthenticatedUser user, HttpServletRequest request) {
        String roleAuthority = "ROLE_" + (user.role() != null ? user.role() : "authenticated");
        var authToken = new UsernamePasswordAuthenticationToken(
                user, null,
                List.of(new SimpleGrantedAuthority(roleAuthority))
        );
        SecurityContextHolder.getContext().setAuthentication(authToken);
    }
}
