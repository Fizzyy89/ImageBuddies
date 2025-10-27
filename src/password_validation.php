<?php
function validatePassword($password) {
    if (strlen($password) < 8) {
        return ['valid' => false, 'error_key' => 'error.password.tooShort'];
    }
    return ['valid' => true];
}
?> 