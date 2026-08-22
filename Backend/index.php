<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");
header("Content-Type: application/json; charset=UTF-8");

echo json_encode([
    "status" => "success",
    "message" => "HemoScan AI REST API Engine is running cleanly in Docker.",
    "version" => "1.0.0",
    "time" => date("Y-m-d H:i:s")
]);
