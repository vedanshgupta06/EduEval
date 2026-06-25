

package com.edueval.dto.response;

import java.util.UUID;

public record StudentResponse(
    UUID id,
    String name,
    String email
) {} 
