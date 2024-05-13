class FilesController {
  static postUpload(req, res) {
    const token = req.get('X-Token');
    if (!token) return res.json(new Error('Unauthorized'));
    return null;
  }
}

export default FilesController;
