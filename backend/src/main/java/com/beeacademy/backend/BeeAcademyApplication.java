package com.beeacademy.backend;

import com.beeacademy.backend.config.SupabaseProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

/**
 * Entry point của Spring Boot application.
 *
 * <p>{@code @SpringBootApplication} là tổ hợp của:
 * <ul>
 *   <li>{@code @Configuration} - đánh dấu class là nguồn bean definitions.</li>
 *   <li>{@code @EnableAutoConfiguration} - bật auto-config dựa trên classpath
 *       (vd: thấy spring-boot-starter-web → tự cấu hình embedded Tomcat).</li>
 *   <li>{@code @ComponentScan} - quét bean từ package này trở xuống
 *       (com.beeacademy.backend.*).</li>
 * </ul>
 *
 * <p>{@code @EnableConfigurationProperties(SupabaseProperties.class)} kích hoạt
 * binding các key {@code supabase.*} trong application.yml vào POJO
 * {@link SupabaseProperties}, để các bean khác inject vào dùng type-safe.
 */
@SpringBootApplication
@EnableConfigurationProperties(SupabaseProperties.class)
public class BeeAcademyApplication {

    /**
     * Khởi động Spring Boot.
     *
     * <p>{@code SpringApplication.run} sẽ:
     * <ol>
     *   <li>Tạo ApplicationContext, scan & khởi tạo bean.</li>
     *   <li>Khởi động embedded Tomcat trên cổng {@code server.port}.</li>
     *   <li>Đăng ký filter chain của Spring Security.</li>
     * </ol>
     */
    public static void main(String[] args) {
        SpringApplication.run(BeeAcademyApplication.class, args);
    }
}
