<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *'); // Allow CORS

$directory = 'azan/';
$mp3Files = [];

if (is_dir($directory)) {
    $files = scandir($directory);
    foreach ($files as $file) {
        if (pathinfo($file, PATHINFO_EXTENSION) === 'mp3') {
            $mp3Files[] = $file;
        }
    }
}

echo json_encode($mp3Files);
?>